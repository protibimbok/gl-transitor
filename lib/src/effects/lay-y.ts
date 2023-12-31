export default `
void main()	{
    vec2 p = uv;
    float x = progress;
    x = smoothstep(.0,1.0,(x*2.0+p.y-1.0));
    
    vec4 f = mix(
        texture2D(texture1, (getUv1(uv)-0.5)*(1.0-x)+0.5), 
        texture2D(texture2, (getUv2(uv)-0.5)*x+0.5), 
        x
    );
    gl_FragColor = f;
}
`