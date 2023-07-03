export default `
// Author: gre
// License: MIT
float amplitude = 100.0;
float speed = 50.0;

void main () {
  vec2 dir = uv - vec2(0.5);
  float dist = length(dir);
  vec2 offset = dir * (sin(progress * dist * amplitude - progress * speed) + .5) / 30.;
  gl_FragColor = mix(
    texture2D(texture1, getUv1(uv + offset)),
    texture2D(texture2, getUv2(uv)),
    smoothstep(0.2, 1.0, progress)
  );
}
`;
