import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Permissions } from '@/webview/Permissions';

afterEach(cleanup);

describe('Permissions', () => {
  it('says Auto blocks the usual forms and is not a sandbox', () => {
    render(<Permissions mode="auto" post={() => undefined} />);
    expect(screen.getByText(/usual forms of git push, rm -r/)).toBeTruthy();
    expect(screen.getByText(/This is not a sandbox/)).toBeTruthy();
  });
});
