import { PROJECT_THREAD, type Attention, type ProjectState, type ThreadRef } from '@/shared';
import mainChat from '../../media/icon-main-chat.svg';
import { maskOf } from './Bough';
import { EpicTickets } from './EpicTickets';
import type { Post } from './host';
import { Row } from './TreeRow';

// A project's main chat: the Elaia tree from media/icon-main-chat.svg, in the text colour.
const MainChat = () => (
  <span
    className="mask-icon tree-logo"
    style={maskOf(mainChat)}
    role="img"
    aria-label="main chat"
  />
);

interface TreeProps {
  projects: ProjectState[];
  selected: ThreadRef | null;
  busy: string[];
  attention?: Record<string, Attention>;
  working?: string[];
  post: Post;
  onSelect(ref: ThreadRef): void;
}

function ProjectNode({
  project,
  ...rest
}: Omit<TreeProps, 'projects'> & { project: ProjectState }) {
  return (
    <div className="tree-project">
      <div className="tree-project-header">
        <span className="tree-project-name">{project.name}</span>
        <button
          className="link tree-remove"
          title="Remove from Elaia"
          onClick={() => rest.post({ type: 'remove-project', project: project.path })}
        >
          ×
        </button>
      </div>
      {project.error && <p className="tree-error">{project.error}</p>}
      <Row
        {...rest}
        refValue={{ project: project.path, thread: PROJECT_THREAD }}
        icon={<MainChat />}
        label="Project chat"
        title="project chat"
      />
      <EpicTickets project={project} {...rest} />
    </div>
  );
}

export function ProjectTree({ projects, ...rest }: TreeProps) {
  return (
    <nav className="tree">
      {projects.length === 0 && <p className="muted">No projects yet.</p>}
      {projects.map((project) => (
        <ProjectNode key={project.path} project={project} {...rest} />
      ))}
      <button className="link tree-add" onClick={() => rest.post({ type: 'add-project' })}>
        + Add project
      </button>
    </nav>
  );
}
