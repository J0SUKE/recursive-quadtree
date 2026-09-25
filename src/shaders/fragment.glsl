varying vec2 vUv;

uniform sampler2D uTexture;
uniform float uThreshold; // color deviation needed to split a cell
uniform float uMaxDepth;  // deepest level allowed (1 = 2x2, 2 = 4x4, ...)
uniform float uLineWidth; // border width in pixels

#define MAX_DEPTH 9 // hard cap for the loop (2^9 = 512 cells per axis)
#define SAMPLES 6   // samples per axis used to measure a cell's variation

// Average color of a cell and how much its colors deviate from that average.
// Depends only on the cell (not on the fragment), so every fragment of a cell
// reaches the same decision and the cell stays a clean rectangle.
vec4 cellStats(vec2 origin, float size)
{
    vec3 sum = vec3(0.0);
    vec3 sumSq = vec3(0.0);

    for (int y = 0; y < SAMPLES; y++)
    {
        for (int x = 0; x < SAMPLES; x++)
        {
            vec2 offset = (vec2(float(x), float(y)) + 0.5) / float(SAMPLES);
            vec3 c = texture2D(uTexture, origin + offset * size).rgb;
            sum += c;
            sumSq += c * c;
        }
    }

    float count = float(SAMPLES * SAMPLES);
    vec3 mean = sum / count;
    vec3 variance = max(sumSq / count - mean * mean, 0.0);
    float deviation = sqrt(variance.r + variance.g + variance.b);

    return vec4(mean, deviation);
}

void main()
{
    vec3 color = vec3(0.0);
    float cells = 1.0;

    // Start from a 2x2 grid and keep splitting the cell containing this
    // fragment while it holds enough color variation.
    for (int level = 1; level <= MAX_DEPTH; level++)
    {
        cells *= 2.0;
        float size = 1.0 / cells;
        vec2 origin = floor(vUv * cells) * size;

        vec4 stats = cellStats(origin, size);
        color = stats.rgb;

        if (float(level) >= uMaxDepth || stats.a < uThreshold) break;
    }

    // Cell borders: distance to the nearest edge of the final cell, in pixels
    vec2 local = fract(vUv * cells);
    vec2 edgeUv = min(local, 1.0 - local) / cells;
    vec2 edgePx = edgeUv / fwidth(vUv);
    float edge = min(edgePx.x, edgePx.y);
    float line = 1.0 - smoothstep(uLineWidth * 0.5 - 0.5, uLineWidth * 0.5 + 0.5, edge);

    gl_FragColor = vec4(mix(color, vec3(0.0), line), 1.0);
}
