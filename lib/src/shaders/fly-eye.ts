export default `
float size = 0.04;
float zoom = 50.0;
float colorSeparation = 0.3;


void main()	{
    float inv = 1.0 - progress;
    vec2 disp = size * vec2(
        cos(zoom*uv.x),
        sin(zoom*uv.y)
    );
    vec4 texTo = texture2D(texture2, getUv2(uv + inv*disp));
    vec4 texFrom = vec4(
        texture2D(texture1, getUv1(uv + progress*disp*(1.0 - colorSeparation))).r,
        texture2D(texture1, getUv1(uv + progress*disp)).g,
        texture2D(texture1, getUv1(uv + progress*disp*(1.0 + colorSeparation))).b,
        1.0
    );
    gl_FragColor = texTo * progress + texFrom*inv;
}
`;
