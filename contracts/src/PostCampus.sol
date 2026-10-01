// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/// @notice A cooperative, non-financial campus game on Base Sepolia.
/// Resources are internal game counters: they cannot be transferred or purchased.
contract PostCampus is ERC721, IERC5192 {
    using Strings for uint256;

    error AlreadyJoined();
    error NotJoined();
    error InvalidBuilding();
    error MaxLevel();
    error InsufficientResources();
    error NothingToCollect();
    error InvalidContribution();
    error Soulbound();
    error Paused();
    error NotGuardian();

    uint256 public constant INITIAL_RESOURCES = 60;
    uint256 public constant HOURLY_RATE = 10;
    uint256 public constant MAX_OFFLINE_SECONDS = 24 hours;
    uint8 public constant MAX_BUILDING_LEVEL = 5;

    uint8 public constant BADGE_JOIN = 1;
    uint8 public constant BADGE_UPGRADE = 2;
    uint8 public constant BADGE_CONTRIBUTE = 4;
    uint8 public constant BADGE_MAX_LEVEL = 8;
    uint8 public constant BADGE_100 = 16;
    uint8 public constant BADGE_1000 = 32;

    struct Player {
        uint256 knowledge;
        uint256 compute;
        uint256 knowledgeRemainder;
        uint256 computeRemainder;
        uint256 lastAccrued;
        uint256 contributed;
        uint8 mainLevel;
        uint8 libraryLevel;
        uint8 badges;
        bool joined;
    }

    address public immutable guardian;
    bool public paused;
    uint256 public currentRound = 1;
    uint256 public roundProgress;
    mapping(address => Player) private _players;

    event Joined(address indexed player, uint256 indexed tokenId);
    event Collected(address indexed player, uint256 knowledge, uint256 compute);
    event Upgraded(address indexed player, uint8 indexed building, uint8 level);
    event Contributed(address indexed player, uint256 indexed round, uint256 amount);
    event RoundCompleted(uint256 indexed round);
    event PauseChanged(bool paused);

    constructor() ERC721("BUPT3DAO Campus Passport", "POST") {
        guardian = msg.sender;
    }

    modifier active() {
        if (paused) revert Paused();
        _;
    }

    function setPaused(bool value) external {
        if (msg.sender != guardian) revert NotGuardian();
        paused = value;
        emit PauseChanged(value);
    }

    function join() external active {
        Player storage player = _players[msg.sender];
        if (player.joined) revert AlreadyJoined();
        player.joined = true;
        player.knowledge = INITIAL_RESOURCES;
        player.compute = INITIAL_RESOURCES;
        player.mainLevel = 1;
        player.libraryLevel = 1;
        player.badges = BADGE_JOIN;
        player.lastAccrued = block.timestamp;

        uint256 tokenId = uint256(uint160(msg.sender));
        // The game mints only to the caller. Avoid an ERC721 receiver callback here:
        // no outside code should run between establishing player state and events.
        _mint(msg.sender, tokenId);
        emit Locked(tokenId);
        emit Joined(msg.sender, tokenId);
    }

    function collect() external active {
        Player storage player = _joinedPlayer();
        uint256 knowledgeBefore = player.knowledge;
        uint256 computeBefore = player.compute;
        _settle(player);
        uint256 gainedKnowledge = player.knowledge - knowledgeBefore;
        uint256 gainedCompute = player.compute - computeBefore;
        if (gainedKnowledge == 0 && gainedCompute == 0) revert NothingToCollect();
        emit Collected(msg.sender, gainedKnowledge, gainedCompute);
    }

    /// @param building 0: Xitucheng main building (compute); 1: Shahe library (knowledge).
    function upgrade(uint8 building) external active {
        Player storage player = _joinedPlayer();
        if (building > 1) revert InvalidBuilding();
        _settle(player);
        uint8 oldLevel = building == 0 ? player.mainLevel : player.libraryLevel;
        if (oldLevel >= MAX_BUILDING_LEVEL) revert MaxLevel();
        uint256 cost = upgradeCost(oldLevel);
        if (player.knowledge < cost || player.compute < cost) revert InsufficientResources();
        player.knowledge -= cost;
        player.compute -= cost;
        uint8 newLevel = oldLevel + 1;
        if (building == 0) player.mainLevel = newLevel;
        else player.libraryLevel = newLevel;
        player.badges |= BADGE_UPGRADE;
        if (player.mainLevel == MAX_BUILDING_LEVEL && player.libraryLevel == MAX_BUILDING_LEVEL) {
            player.badges |= BADGE_MAX_LEVEL;
        }
        emit Upgraded(msg.sender, building, newLevel);
    }

    /// @notice Both resource balances are charged equally. One call belongs to one round.
    function contribute(uint256 amount) external active {
        Player storage player = _joinedPlayer();
        _settle(player);
        uint256 round = currentRound;
        uint256 remaining = roundGoal(round) - roundProgress;
        if (amount == 0 || amount > remaining) revert InvalidContribution();
        if (player.knowledge < amount || player.compute < amount) revert InsufficientResources();
        player.knowledge -= amount;
        player.compute -= amount;
        player.contributed += amount;
        player.badges |= BADGE_CONTRIBUTE;
        if (player.contributed >= 100) player.badges |= BADGE_100;
        if (player.contributed >= 1000) player.badges |= BADGE_1000;
        roundProgress += amount;
        emit Contributed(msg.sender, round, amount);
        if (roundProgress == roundGoal(round)) {
            currentRound = round + 1;
            roundProgress = 0;
            emit RoundCompleted(round);
        }
    }

    function upgradeCost(uint8 oldLevel) public pure returns (uint256) {
        if (oldLevel == 0 || oldLevel >= MAX_BUILDING_LEVEL) revert MaxLevel();
        return 50 * uint256(oldLevel) * uint256(oldLevel);
    }

    function roundGoal(uint256 round) public pure returns (uint256) {
        return 1000 * round;
    }

    function getWorld()
        external
        view
        returns (uint256 round, uint256 goal, uint256 progress, bool stopped)
    {
        return (currentRound, roundGoal(currentRound), roundProgress, paused);
    }

    function getPlayer(address account) external view returns (Player memory) {
        return _preview(_players[account]);
    }

    function getPending(address account)
        external
        view
        returns (uint256 knowledge, uint256 compute)
    {
        Player memory previous = _players[account];
        Player memory current = _preview(previous);
        return (current.knowledge - previous.knowledge, current.compute - previous.compute);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address account = ownerOf(tokenId);
        Player storage player = _players[account];
        string memory image = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">',
            '<rect width="600" height="600" rx="32" fill="#241b52"/>',
            '<circle cx="450" cy="148" r="108" fill="#5543aa"/>',
            '<path d="M80 400 300 270 520 400 300 530Z" fill="#9d8bdb"/>',
            '<path d="M160 400V285l140-80 140 80v115L300 480Z" fill="#6c57c1"/>',
            '<path d="M160 285 300 205 440 285 300 365Z" fill="#c7b7fb"/>',
            '<text x="52" y="85" font-size="34" fill="white">BUPT3DAO CAMPUS</text>',
            '<text x="52" y="555" font-size="24" fill="white">MAIN ',
            uint256(player.mainLevel).toString(),
            " / LIBRARY ",
            uint256(player.libraryLevel).toString(),
            "</text></svg>"
        );
        string memory metadata = string.concat(
            unicode'{"name":"链上邮园共建者 #',
            tokenId.toString(),
            unicode'","description":"BUPT3DAO Base Sepolia 校园建设通行证；不可转让。",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(image)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(metadata)));
    }

    function _joinedPlayer() private view returns (Player storage player) {
        player = _players[msg.sender];
        if (!player.joined) revert NotJoined();
    }

    function _settle(Player storage player) private {
        Player memory updated = _preview(player);
        player.knowledge = updated.knowledge;
        player.compute = updated.compute;
        player.knowledgeRemainder = updated.knowledgeRemainder;
        player.computeRemainder = updated.computeRemainder;
        player.lastAccrued = updated.lastAccrued;
    }

    function _preview(Player memory player) private view returns (Player memory) {
        if (!player.joined || block.timestamp <= player.lastAccrued) return player;
        uint256 elapsed = block.timestamp - player.lastAccrued;
        if (elapsed > MAX_OFFLINE_SECONDS) elapsed = MAX_OFFLINE_SECONDS;
        uint256 knowledgeUnits =
            player.knowledgeRemainder + elapsed * HOURLY_RATE * player.libraryLevel;
        uint256 computeUnits = player.computeRemainder + elapsed * HOURLY_RATE * player.mainLevel;
        player.knowledge += knowledgeUnits / 1 hours;
        player.compute += computeUnits / 1 hours;
        player.knowledgeRemainder = knowledgeUnits % 1 hours;
        player.computeRemainder = computeUnits % 1 hours;
        player.lastAccrued = block.timestamp;
        return player;
    }
}
