import AppHeader from '../components/AppHeader'

function EditorPage({
  headerProps,
  draft,
  setDraft,
  addListItem,
  updateListItem,
  removeListItem,
  updateExperienceField,
  updateExperienceBullet,
  addExperienceBullet,
  removeExperienceBullet,
  handleCopy,
  handleRefineWithAi,
  handleDownloadTxt,
  handleDownload,
  refining,
  exportingPdf,
  copyStatus,
  previewRef,
  activeModal,
  setActiveModal,
  components,
}) {
  const {
    SectionCard,
    StringListEditor,
    HarvardResumePreview,
    PageFooter,
    PolicyModal,
  } = components

  return (
    <main className="screen results-screen">
      <AppHeader {...headerProps} />
      <section className="editor-layout structured-editor-layout">
        <article className="editor-panel structured-editor-panel">
          <p className="eyebrow">Structured Resume Editor</p>
          <h2 className="serif">Harvard Resume Builder</h2>

          <SectionCard title="Professional Summary">
            <textarea
              value={draft.summary}
              onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
              rows={5}
              className="ghost-input"
              placeholder="Write a concise professional summary"
            />
          </SectionCard>

          <SectionCard title="Core Competencies">
            <StringListEditor
              items={draft.skills}
              onAdd={() => addListItem('skills', '')}
              onChange={(idx, value) => updateListItem('skills', idx, value)}
              onRemove={(idx) => removeListItem('skills', idx)}
              placeholder="Skill"
            />
          </SectionCard>

          <SectionCard title="Professional Experience">
            {draft.experience.map((exp, idx) => (
              <div key={`exp-${idx}`} className="nested-card">
                <div className="two-col">
                  <input className="ghost-input" value={exp.company} onChange={(e) => updateExperienceField(idx, 'company', e.target.value)} placeholder="Company Name" />
                  <input className="ghost-input" value={exp.jobTitle} onChange={(e) => updateExperienceField(idx, 'jobTitle', e.target.value)} placeholder="Job Title" />
                </div>
                <div className="three-col">
                  <input className="ghost-input" value={exp.startDate} onChange={(e) => updateExperienceField(idx, 'startDate', e.target.value)} placeholder="Start Date" />
                  <input className="ghost-input" value={exp.endDate} disabled={exp.isPresent} onChange={(e) => updateExperienceField(idx, 'endDate', e.target.value)} placeholder="End Date" />
                  <label className="checkbox-row"><input type="checkbox" checked={exp.isPresent} onChange={(e) => updateExperienceField(idx, 'isPresent', e.target.checked)} /> Present</label>
                </div>

                <StringListEditor
                  label="Responsibilities"
                  items={exp.responsibilities}
                  onAdd={() => addExperienceBullet(idx)}
                  onChange={(bIdx, value) => updateExperienceBullet(idx, bIdx, value)}
                  onRemove={(bIdx) => removeExperienceBullet(idx, bIdx)}
                  placeholder="Responsibility bullet"
                />

                <button type="button" className="remove-btn" onClick={() => removeListItem('experience', idx)}>Remove Experience</button>
              </div>
            ))}
            <button type="button" className="add-btn" onClick={() => addListItem('experience', { company: '', jobTitle: '', startDate: '', endDate: '', isPresent: false, responsibilities: [''] })}>Add Experience</button>
          </SectionCard>

          <SectionCard title="Projects (Optional)">
            {draft.projects.map((project, idx) => (
              <div key={`proj-${idx}`} className="nested-card">
                <input className="ghost-input" value={project.name} onChange={(e) => updateListItem('projects', idx, { ...project, name: e.target.value })} placeholder="Project Name" />
                <textarea className="ghost-input" rows={4} value={project.description} onChange={(e) => updateListItem('projects', idx, { ...project, description: e.target.value })} placeholder="Project bullets (one per line)" />
                <input className="ghost-input" value={project.technologies} onChange={(e) => updateListItem('projects', idx, { ...project, technologies: e.target.value })} placeholder="Technologies used" />
                <button type="button" className="remove-btn" onClick={() => removeListItem('projects', idx)}>Remove Project</button>
              </div>
            ))}
            <button type="button" className="add-btn" onClick={() => addListItem('projects', { name: '', description: '', technologies: '' })}>Add Project</button>
          </SectionCard>

          <SectionCard title="Education">
            {draft.education.map((edu, idx) => (
              <div key={`edu-${idx}`} className="nested-card">
                <div className="three-col">
                  <input className="ghost-input" value={edu.school} onChange={(e) => updateListItem('education', idx, { ...edu, school: e.target.value })} placeholder="School Name" />
                  <input className="ghost-input" value={edu.degree} onChange={(e) => updateListItem('education', idx, { ...edu, degree: e.target.value })} placeholder="Degree" />
                  <input className="ghost-input" value={edu.year} onChange={(e) => updateListItem('education', idx, { ...edu, year: e.target.value })} placeholder="Year" />
                </div>
                <button type="button" className="remove-btn" onClick={() => removeListItem('education', idx)}>Remove Education</button>
              </div>
            ))}
            <button type="button" className="add-btn" onClick={() => addListItem('education', { school: '', degree: '', year: '' })}>Add Education</button>
          </SectionCard>

          <SectionCard title="References (Optional)">
            <StringListEditor
              items={draft.references || []}
              onAdd={() => addListItem('references', '')}
              onChange={(idx, value) => updateListItem('references', idx, value)}
              onRemove={(idx) => removeListItem('references', idx)}
              placeholder="Reference line (e.g., Available upon request)"
            />
          </SectionCard>

          <div className="action-row">
            <button type="button" onClick={handleCopy}>Copy Plaintext</button>
            <button type="button" onClick={handleRefineWithAi} disabled={refining}>{refining ? 'Refining...' : 'Refine with AI'}</button>
            <button type="button" onClick={handleDownloadTxt}>Download TXT</button>
            <button type="button" onClick={handleDownload} className="primary" disabled={exportingPdf}>{exportingPdf ? 'Exporting PDF...' : 'Export PDF'}</button>
          </div>
        </article>

        <article className="preview-panel structured-preview-panel">
          <div className="preview-actions sticky-preview-actions">
            <button type="button" onClick={handleDownloadTxt}>Download TXT</button>
            <button type="button" onClick={handleDownload} className="primary" disabled={exportingPdf}>{exportingPdf ? 'Exporting PDF...' : 'Download PDF'}</button>
          </div>
          <p className="eyebrow">Live Preview</p>
          <HarvardResumePreview draft={draft} previewRef={previewRef} />
        </article>
      </section>
      {copyStatus && <p className="status">{copyStatus}</p>}
      <PageFooter onModalOpen={setActiveModal} />
      {activeModal && <PolicyModal type={activeModal} onClose={() => setActiveModal(null)} />}
    </main>
  )
}

export default EditorPage
