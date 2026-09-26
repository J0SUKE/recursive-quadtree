varying vec2 vUv;

void main()
{
    // Unit plane stretched to cover the whole render target
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);

    vUv = uv;
}
