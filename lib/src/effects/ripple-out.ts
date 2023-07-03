export default `
float width = 0.35;
float radius = 0.9;

float parabola( float x, float k ) {
    return pow( 4. * x * ( 1. - x ), k );
}

void main()	{
    if (progress == 1.0) {
        gl_FragColor = texture2D( texture2, getUv2(uv));
        return;
    }
    vec2 p = uv;
    vec2 start = vec2(0.5,0.5);

    float dt = parabola(progress, 1.);
    vec2 disp = vec2(
        cos(uv.x),
        sin(uv.y)
    );
    vec4 noise = texture2D(texture1, getUv1(disp));
    float prog = progress*0.66 + noise.g * 0.04;
    float circ = 1. - smoothstep(-width, 0.0, radius * distance(start, uv) - prog*(1.+width));
    float intpl = pow(abs(circ), 1.);
    vec4 t1 = texture2D( texture1, getUv1((uv - 0.5) * (1.0 - intpl) + 0.5 )) ;
    vec4 t2 = texture2D( texture2, getUv2((uv - 0.5) * intpl + 0.5 ));
    gl_FragColor = mix( t1, t2, intpl );

}
`