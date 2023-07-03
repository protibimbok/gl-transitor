# gl-transitor

A simple way to complex shader image transitions.

## Usage

```typescript
import { GLTransitor } from 'gl-transitor';
import GLTransitorEffects from 'gl-transitor/shaders';

const transitor = GLTransitor.init('#canvas', GLTransitorEffects);

transitor.animate('#img-1', {
    url: 'https://some.url',
});

const from = transitor.createTexture(document.querySelector('#image-1'));

const to = transitor.createTexture(document.querySelector('#image-2'));

transitor.animateTexture(from, to);
```
