varying vec2 vUv;

uniform sampler2D uSource;
uniform float uSize; // render target size in texels

#define TAPS 4 // taps per axis, each one bilinear (2x2 source texels)

// Shrinks the source into the stats texture:
// rgb = average color, a = average of dot(color, color).
// Its mipmaps then hold both averages for every quadtree cell.
void main()
{
    vec3 sum = vec3(0.0);
    float sumSq = 0.0;

    for (int y = 0; y < TAPS; y++)
    {
        for (int x = 0; x < TAPS; x++)
        {
            vec2 offset = ((vec2(float(x), float(y)) + 0.5) / float(TAPS) - 0.5) / uSize;
            vec3 c = texture2D(uSource, vUv + offset).rgb;
            sum += c;
            sumSq += dot(c, c);
        }
    }

    float count = float(TAPS * TAPS);
    gl_FragColor = vec4(sum / count, sumSq / count);
}
