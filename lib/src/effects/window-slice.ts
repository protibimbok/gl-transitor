export default `
float count = 10.0;
float smoothness = 0.5;

void main () {
  float pr = smoothstep(-smoothness, 0.0, uv.x - progress * (1.0 + smoothness));
  float s = step(pr, fract(count * uv.x));
  vec4 img1 = texture2D(texture1, getUv1(uv));
  vec4 img2 = texture2D(texture2, getUv2(uv));
  gl_FragColor =  mix(img1, img2, s);
}
`;