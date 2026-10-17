import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectTree } from '@/webview/ProjectTree';
import { TicketFacts } from '@/webview/TicketFacts';
import type { ProjectState } from '@/shared';
import { makeTicket } from '../support/ticket';

afterEach(cleanup);

const project: ProjectState = {
  path: '/repos/frontline',
  name: 'frontline',
  tickets: [
    makeTicket({
      id: 't-ready',
      title: 'ready one',
      summary: { rank: 0, text: 't  ✔ ready for you  — clean' },
    }),
    makeTicket({
      id: 't-stuck',
      title: 'stuck one',
      summary: { rank: 0, text: 't  ⚠ needs you  — x' },
    }),
  ],
  tokens: [
    {
      ticket: 't-ready',
      runs: 3,
      durationMs: 1000,
      tokensIn: 1200,
      tokensOut: 48000,
      tokensCacheRead: 2_500_000,
    },
  ],
  chatTokens: {},
  epics: [],
  error: null,
};

describe('ProjectTree', () => {
  it('lists the project chat and each ticket with its status', () => {
    const onSelect = vi.fn();
    render(
      <ProjectTree
        projects={[project]}
        selected={null}
        busy={[]}
        post={vi.fn()}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('Project chat')).toBeTruthy();
    expect(screen.getByTitle('ready for you')).toBeTruthy();
    expect(screen.getByTitle('needs you')).toBeTruthy();
    fireEvent.click(screen.getByText('stuck one'));
    expect(onSelect).toHaveBeenCalledWith({ project: '/repos/frontline', thread: 't-stuck' });
  });

  it('adds a project', () => {
    const post = vi.fn();
    render(<ProjectTree projects={[]} selected={null} busy={[]} post={post} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add project' }));
    expect(post).toHaveBeenCalledWith({ type: 'add-project' });
  });
});

describe('TicketFacts', () => {
  it('shows stage, QA per criterion and tokens including cache', () => {
    const ticket = makeTicket({
      id: 't-ready',
      criteria: [
        { id: 'AC-1', text: 'export works' },
        { id: 'AC-2', text: 'empty file' },
      ],
      qa: {
        outcome: null,
        results: [{ id: 'AC-1', result: 'pass', evidence: 'ok', verified: true }],
      },
    });
    render(
      <TicketFacts
        project={project}
        ticket={ticket}
        threadRef={{ project: project.path, thread: 't-ready' }}
        post={vi.fn()}
      />,
    );
    expect(screen.getByText('planned')).toBeTruthy();
    expect(screen.getByText(/AC-1/).textContent).toContain('✅');
    expect(screen.getByText(/AC-2/).textContent).toContain('○');
    expect(screen.getByText('2.5M')).toBeTruthy();
  });

  it('Open folder names the ticket, not a path', () => {
    const post = vi.fn();
    const ticket = makeTicket({ id: 't-ready', worktree: '/wt/t-ready' });
    render(
      <TicketFacts
        project={project}
        ticket={ticket}
        threadRef={{ project: project.path, thread: 't-ready' }}
        post={post}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(post).toHaveBeenCalledWith({
      type: 'open-folder',
      project: project.path,
      ticket: 't-ready',
    });
  });
});
