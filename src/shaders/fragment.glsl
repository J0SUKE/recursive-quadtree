varying vec2 vUv;

uniform sampler2D uStats; // rgb = average color, a = average of dot(color, color), mipmapped
uniform float uThreshold; // color deviation needed to split a cell
uniform float uMaxDepth;  // animation progress: level-L cells split while it goes from L to L + 1
uniform float uStagger;   // 0 = all cells of a level split together, 1 = one after another

// STATS_LEVELS = log2(stats texture size), injected from JS (512 -> 9)

// Visit order of the 4 children of a cell: top-left, top-right, bottom-right, bottom-left
// (vUv.y points up, so odd y is the top row)
float quadrantOrder(ivec2 cell)
{
    int x = cell.x & 1;
    int y = cell.y & 1;
    if (y == 1) return x == 0 ? 0.0 : 1.0;
    return x == 1 ? 2.0 : 3.0;
}

void main()
{
    vec3 color = vec3(0.0);
    float cells = 1.0;

    // Position of the current cell in the split order, in [0, 1).
    // Built from each ancestor's quadrant (like digits in base 4), so all of
    // top-left's descendants go before top-right's, and so on recursively.
    float order = 0.0;
    float orderWeight = 0.25;

    // Start from a 2x2 grid and keep splitting the cell containing this
    // fragment while it holds enough color variation.
    for (int level = 1; level <= STATS_LEVELS; level++)
    {
        cells *= 2.0;

        // A level-L cell is exactly one texel of the 2^L x 2^L mip,
        // which already holds the averages over the whole cell.
        ivec2 cell = min(ivec2(vUv * cells), ivec2(cells) - 1);
        vec4 stats = texelFetch(uStats, cell, STATS_LEVELS - level);

        color = stats.rgb;
        float deviation = sqrt(max(stats.a - dot(stats.rgb, stats.rgb), 0.0));

        order += quadrantOrder(cell) * orderWeight;
        orderWeight *= 0.25;

        // This cell's split time within the [level, level + 1] step
        bool splitReached = uMaxDepth - float(level) > order * uStagger;

        if (!splitReached || deviation < uThreshold) break;
    }

    // Cell borders: distance to the nearest edge of the final cell, in pixels
    vec2 local = fract(vUv * cells);
    vec2 edgeUv = min(local, 1.0 - local) / cells;
    vec2 edgePx = edgeUv / fwidth(vUv);
    float edge = min(edgePx.x, edgePx.y);
    float line = 1.0 - smoothstep(0.5 - 0.5,0.5 + 0.5, edge);

    gl_FragColor = vec4(mix(color, vec3(0.0), line), 1.0);
}
