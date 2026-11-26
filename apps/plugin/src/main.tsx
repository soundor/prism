import { registerFonts } from '@soundor/components';
import { render } from '@soundor/react';

import { persistInterfaceScale } from './scale';
import { App } from './ui/App';

void registerFonts().catch((error: unknown) => console.warn('Prism fonts could not load', error));
persistInterfaceScale();
render(<App />);
