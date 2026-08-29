import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryContainerPicker, resolveMemoryProject } from '../MemoryContainerPicker';

const containers = [
  { containerTag: 'repo_sample_project__abc', name: 'Agents · sample-project', documentCount: 2, memoryCount: 10 },
  { containerTag: 'repo_other__def', name: 'Other', documentCount: 1, memoryCount: 3 },
];

describe('MemoryContainerPicker', () => {
  it('derives a canonical project identity from a GitLab MR URL', () => {
    expect(resolveMemoryProject('https://gitlab.example.com/example-org/sample-project/-/merge_requests/42')).toEqual({
      projectUrl: 'https://gitlab.example.com/example-org/sample-project',
      slug: 'sample-project',
      tagPrefix: 'repo_sample_project__',
    });
    expect(resolveMemoryProject('invalid')).toBeNull();
    expect(resolveMemoryProject('file:///group/project/-/merge_requests/1')).toBeNull();
  });

  it.each([
    'https://gitlab.example.com/projects/example-org/sample-project/merge_requests/42',
    'https://gitlab.example.com/example-org/sample-project/merge_requests/42',
  ])('supports alternate GitLab MR URL format %s', (url) => {
    expect(resolveMemoryProject(url)?.projectUrl)
      .toBe('https://gitlab.example.com/example-org/sample-project');
  });

  it('prioritizes matching containers and supports override', () => {
    const onChange = vi.fn();
    render(<MemoryContainerPicker
      project={resolveMemoryProject('https://gitlab.example.com/example-org/sample-project/-/merge_requests/1')}
      containers={containers}
      status="ready"
      value="repo_sample_project__abc"
      onChange={onChange}
      onRefresh={vi.fn()}
    />);

    expect(screen.getByRole('group', { name: 'Recommended for sample-project' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Project memory container'), { target: { value: 'repo_other__def' } });
    expect(onChange).toHaveBeenCalledWith('repo_other__def');
  });

  it('disables selection until the MR URL is valid and reports auth state', () => {
    const { rerender } = render(<MemoryContainerPicker
      project={null}
      containers={[]}
      status="ready"
      value=""
      onChange={vi.fn()}
      onRefresh={vi.fn()}
    />);
    expect(screen.getByLabelText('Project memory container')).toBeDisabled();

    rerender(<MemoryContainerPicker
      project={resolveMemoryProject('https://gitlab.example.com/group/project/-/merge_requests/1')}
      containers={[]}
      status="not_authenticated"
      value=""
      onChange={vi.fn()}
      onRefresh={vi.fn()}
    />);
    expect(screen.getByText(/supermemory login/i)).toBeInTheDocument();
  });
});
