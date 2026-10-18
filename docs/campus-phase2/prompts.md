# 建筑素材生成记录

模式：内置 `image_gen`，每个素材单独生成，`transparent_background=true`。主楼、图书馆和大龙邮票分别传入本目录 `references/` 中对应的实景照片作为建筑参考；广场和实验室为原创设计。生成的 PNG 保留在生成工具的输出目录；网站版本以带 alpha 的 WebP 随代码交付。

五个建筑素材共用以下提示前缀，后面拼接各自段落：

```text
Use case: stylized-concept. Asset type: production 2.5D isometric game building sprite for a university miniature campus. Style: refined architectural scale-model, realistic distinctive architecture with subtly hand-painted material textures, calm ivory sandstone / warm brick / muted sage palette. Orthographic fixed isometric view from above, camera elevation about 35 degrees, view front and right side, consistent sunlight upper left. Whole subject isolated centered with generous transparent padding, no background, no ground platform, no cast ground shadow, no labels, no watermark, no people. Actual alpha transparency. No dollhouse exaggeration. Crisp readable silhouette, fine facade detail.
```

## main

```text
Architectural reference image is the real BUPT Xitucheng main building. Reinterpret THIS building faithfully as an original sprite: a tall pale ivory rectangular tower about 13 stories, regular narrow blue-grey horizontal window grids, broad flat roof cornice with small side rooftop vents, low 3-story wings on both sides, central dark glass entrance and small entrance steps. Preserve its tall vertical proportions and tower-with-two-short-wings composition. No spire, no clock, no pagoda. Three-quarter isometric miniature, showing roof and side. Building only.
```

## library

```text
Architectural reference image is the real BUPT Shahe library. Reinterpret THIS building faithfully as an original sprite: wide modern circular/cylindrical upper glass rotunda, dense slender pale vertical fins and a broad flat overhanging circular roof; lower rectilinear red-brown brick podium with tall recessed rectangular openings, central entrance and entry stairs. Preserve the curved glass drum above a square warm-brick base. Low wide proportions, not a tower. Three-quarter isometric miniature. Building only.
```

## sculpture

```text
Architectural reference is the real BUPT large dragon postage stamp STONE RELIEF INSET FLAT INTO A GARDEN PATH, NOT an upright sculpture. Make an original isometric sprite: large flat rectangular pale pink-beige carved marble postage-stamp paving panel, shallow beveled edges, ornate Chinese dragon bas-relief in its centre, engraved postage border and subtle CHINA / 3 details. It lies flat horizontally at pavement level, like a large decorative floor tile. No standing statue, no plinth, no trees. Whole single slab viewed from isometric above. Relief legible as dragon motif.
```

## plaza

```text
Original artistic community plaza landmark: low circular ivory stone fountain basin and a slender TRIANGULAR clock tower with three clock faces in muted aged brass and light stone, small circular paving immediately around basin, restrained water detail. A tasteful contemporary Chinese university campus time square. Compact low water basin and a delicate tall clock feature. No medieval castle, no fantasy gems, no text. Artistic scene, not a claim of precise real architecture.
```

## lab

```text
Original artistic BUPT3DAO community research laboratory: compact contemporary 3-story university innovation building, warm off-white concrete, dark slate framing, muted teal glass windows and solar roof panels, a small roof antenna, clear entrance recess, subtly stepped massing. Elegant academic architecture, no corporate logo, no text. Match realistic architectural scale model, NOT toy blocks. Building only.
```

## tree（独立完整提示）

```text
Use case: stylized-concept. Production 2.5D miniature university campus environment sprite. One mature leafy deciduous tree isolated on genuine transparent background, camera isometric 35 degrees above, visible trunk and natural branching, dense textured soft sage-green foliage, refined realistic architectural scale-model style matching warm brick and ivory university buildings. Not a cartoon oval. Full tree centered with generous padding, no ground, no cast ground shadow, no people, no text, no watermark. Warm upper-left daylight. Alpha transparency.
```
