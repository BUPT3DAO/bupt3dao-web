// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PostCampus, IERC5192} from "../src/PostCampus.sol";

interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address caller) external;
    function expectRevert(bytes4 selector) external;
}

contract PostCampusTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    PostCampus private game;

    function setUp() public {
        game = new PostCampus();
    }

    function _join(address account) private {
        vm.prank(account);
        game.join();
    }

    function testJoinMintsOneNontransferablePassport() public {
        _join(ALICE);
        PostCampus.Player memory player = game.getPlayer(ALICE);
        require(player.joined && player.knowledge == 60 && player.compute == 60);
        require(player.mainLevel == 1 && player.libraryLevel == 1);
        uint256 tokenId = uint256(uint160(ALICE));
        require(game.ownerOf(tokenId) == ALICE && game.locked(tokenId));
        require(game.supportsInterface(type(IERC5192).interfaceId));
        require(bytes(game.tokenURI(tokenId)).length > 100);

        vm.prank(ALICE);
        vm.expectRevert(PostCampus.AlreadyJoined.selector);
        game.join();

        vm.prank(ALICE);
        vm.expectRevert(PostCampus.Soulbound.selector);
        game.transferFrom(ALICE, BOB, tokenId);

        vm.prank(ALICE);
        vm.expectRevert(PostCampus.Soulbound.selector);
        game.approve(BOB, tokenId);
    }

    function testUpgradeSettlesAtOldRateAndRaisesNewRate() public {
        _join(ALICE);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(ALICE);
        game.upgrade(0);
        PostCampus.Player memory player = game.getPlayer(ALICE);
        require(player.knowledge == 20 && player.compute == 20);
        require(player.mainLevel == 2 && player.libraryLevel == 1);

        vm.warp(block.timestamp + 1 hours);
        player = game.getPlayer(ALICE);
        require(player.knowledge == 30 && player.compute == 40);
        require(player.badges & game.BADGE_UPGRADE() != 0);
    }

    function testFrequentCollectionPreservesFractions() public {
        _join(ALICE);
        for (uint256 i = 0; i < 4; ++i) {
            vm.warp(block.timestamp + 15 minutes);
            vm.prank(ALICE);
            game.collect();
        }
        PostCampus.Player memory player = game.getPlayer(ALICE);
        require(player.knowledge == 70 && player.compute == 70);
    }

    function testCannotSpendUnownedResourcesOrCrossRounds() public {
        _join(ALICE);
        vm.prank(ALICE);
        game.upgrade(0);
        vm.prank(ALICE);
        vm.expectRevert(PostCampus.InsufficientResources.selector);
        game.upgrade(1);
        vm.prank(ALICE);
        vm.expectRevert(PostCampus.InsufficientResources.selector);
        game.contribute(11);
        vm.prank(ALICE);
        vm.expectRevert(PostCampus.InvalidContribution.selector);
        game.contribute(0);
        vm.prank(ALICE);
        game.contribute(10);
        require(game.getPlayer(ALICE).contributed == 10);
    }

    function testRoundCompletesExactlyOnce() public {
        for (uint160 i = 0; i < 5; ++i) {
            _join(address(100 + i));
        }
        vm.warp(block.timestamp + 24 hours);
        for (uint160 i = 0; i < 5; ++i) {
            vm.prank(address(100 + i));
            game.contribute(200);
        }
        (uint256 round, uint256 goal, uint256 progress,) = game.getWorld();
        require(round == 2 && goal == 2000 && progress == 0);
        require(game.getPlayer(address(100)).contributed == 200);
        require(game.getPlayer(address(100)).badges & game.BADGE_100() != 0);
    }

    function testPauseOnlyBlocksWritesAndOnlyGuardianCanSetIt() public {
        vm.prank(ALICE);
        vm.expectRevert(PostCampus.NotGuardian.selector);
        game.setPaused(true);
        game.setPaused(true);
        vm.prank(ALICE);
        vm.expectRevert(PostCampus.Paused.selector);
        game.join();
        (,,, bool stopped) = game.getWorld();
        require(stopped);
        game.setPaused(false);
        _join(ALICE);
    }

    function testFuzzOfflineRewardsHaveOneDayCap(uint32 waitSeconds) public {
        _join(ALICE);
        vm.warp(block.timestamp + uint256(waitSeconds));
        PostCampus.Player memory player = game.getPlayer(ALICE);
        uint256 capped = waitSeconds > 24 hours ? 24 hours : waitSeconds;
        uint256 expected = 60 + capped * 10 / 1 hours;
        require(player.knowledge == expected && player.compute == expected);
    }
}
