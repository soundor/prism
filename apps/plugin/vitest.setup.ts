import { mockNative } from '@soundor/testing-library/react';
import { beforeEach } from 'vitest';

// The editor asks the processor to analyze whenever it opens: there is no
// processor here, so the call does nothing unless a test mocks it again.
beforeEach(() => mockNative('analyze', () => {}));
