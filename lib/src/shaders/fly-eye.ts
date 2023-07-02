export const fragment = `
float size = 0.04;
float zoom = 50.0;
float colorSeparation = 0.3;


void main()	{
    float inv = 1.0 - progress;
    vec2 disp = size * vec2(
        cos(zoom*uv.x),
        sin(zoom*uv.y)
    );
    vec4 texTo = texture2D(texture2, fittedUv(size2, uv + inv*disp, resolution));
    vec4 texFrom = vec4(
        texture2D(texture1, fittedUv(size1, uv + progress*disp*(1.0 - colorSeparation), resolution)).r,
        texture2D(texture1, fittedUv(size1, uv + progress*disp, resolution)).g,
        texture2D(texture1, fittedUv(size1, uv + progress*disp*(1.0 + colorSeparation), resolution)).b,
        1.0
    );
    gl_FragColor = texTo * progress + texFrom*inv;
}
`;
