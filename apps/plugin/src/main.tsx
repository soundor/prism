import { registerFonts } from '@soundor/components';
import { render } from '@soundor/react';

import { App } from './app/app';

void registerFonts().catch((error: unknown) => console.warn('Prism fonts could not load', error));
render(<App />);
