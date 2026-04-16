import AppHeader from '../components/AppHeader'

function AnalysisPage({
  headerProps,
  score,
  circumference,
  dashOffset,
  result,
  executiveSummary,
  breakdown,
  normalizedScoring,
  criticalGaps,
  moderateGaps,
  optionalGaps,
  missingKeywords,
  phrasingImprovements,
  draft,
  previewRef,
  refining,
  exportingPdf,
  handleCopy,
  handleRefineWithAi,
  handleDownloadTxt,
  handleDownload,
  handleTryAnother,
  activeModal,
  setActiveModal,
  components,
}) {
  const { ResultCard, HarvardResumePreview, PageFooter, PolicyModal } = components

  return (
    <main className="screen results-screen">
      <AppHeader {...headerProps} />
      <section className="results-hero">
        <div>
          <p className="eyebrow">Intelligence Report</p>
          <h1 className="serif display">Precision Alignment.</h1>
          <p className="lead small">Your profile has been cross-referenced with ATS and role-specific heuristics.</p>
        </div>
        <div className="score-orb">
          <svg viewBox="0 0 120 120" className="score-ring">
            <circle cx="60" cy="60" r="52" className="ring-bg" />
            <circle cx="60" cy="60" r="52" className="ring-value" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
          </svg>
          <strong>{score}%</strong>
          <span>Match Score</span>
        </div>
      </section>

      <section className="insight-grid">
        <ResultCard title="Strategic Assets" items={result.strengths} tone="success" />
        <ResultCard title="Growth Opportunities" items={result.skill_gaps} tone="warning" />
        <ResultCard title="Actionable Refinements" items={result.suggestions} tone="info" />
      </section>

      <section className="report-section">
        <div className="report-head">
          <p className="eyebrow">Executive Summary</p>
          <h3 className="serif">Evaluation Narrative</h3>
        </div>
        <p className="report-paragraph">{executiveSummary}</p>
      </section>

      <section className="report-section">
        <div className="report-head">
          <p className="eyebrow">Quantitative Breakdown</p>
          <h3 className="serif">Normalized Scoring Components</h3>
        </div>
        <div className="table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Weighted</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((item, idx) => {
                const rawScore = Number(item?.score || 0)
                const clampedScore = Math.max(0, Math.min(100, rawScore))
                const weight = Number(item?.weight || 0)
                const weighted = (clampedScore * weight).toFixed(2)
                return (
                  <tr key={`score-row-${idx}`}>
                    <td>{item?.category || 'N/A'}</td>
                    <td>{clampedScore}%</td>
                    <td>{(weight * 100).toFixed(1)}%</td>
                    <td>{weighted}</td>
                    <td>{item?.reasoning || 'No reasoning provided.'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="formula-line">{normalizedScoring}</p>
      </section>

      <section className="report-section report-grid-2">
        <ResultCard title="Critical Gaps" items={criticalGaps} tone="warning" />
        <ResultCard title="Moderate Gaps" items={moderateGaps} tone="info" />
      </section>

      <section className="report-section report-grid-2">
        <ResultCard title="Optional Gaps" items={optionalGaps} tone="info" />
        <ResultCard title="ATS Missing Keywords" items={missingKeywords} tone="warning" />
      </section>

      <section className="report-section">
        <ResultCard title="ATS Phrasing Improvements" items={phrasingImprovements} tone="success" />
      </section>

      <section className="output-head">
        <div>
          <p className="eyebrow">Output Preview</p>
          <h2 className="serif">Harvard Resume Output</h2>
        </div>
        {result?.ats_resume && (
          <div className="action-row">
            <button type="button" onClick={handleCopy}>Copy Plaintext</button>
            <button type="button" onClick={handleRefineWithAi} disabled={refining}>{refining ? 'Refining...' : 'Refine with AI'}</button>
            <button type="button" onClick={handleDownloadTxt}>Download TXT</button>
            <button type="button" onClick={handleDownload} className="primary" disabled={exportingPdf}>{exportingPdf ? 'Exporting PDF...' : 'Export PDF'}</button>
          </div>
        )}
      </section>

      {result?.ats_resume ? (
        <div className="resume-preview"><HarvardResumePreview draft={draft} previewRef={previewRef} /></div>
      ) : (
        <div className="error-pill">No tailored resume draft generated yet. Re-run analysis.</div>
      )}

      {!result.is_qualified && result?.ats_resume && (
        <div className="status">Current match is below qualified threshold, but a tailored draft has been generated for improvement.</div>
      )}
      {refining && <p className="status">Applying AI suggestions and refining your resume draft...</p>}

      <section className="retry-block">
        <h3 className="serif">Iterate toward perfection.</h3>
        <p>Adjust details and run analysis again to improve your score.</p>
        <button type="button" onClick={handleTryAnother}>Try Another Analysis</button>
      </section>

      <PageFooter onModalOpen={setActiveModal} />
      {activeModal && <PolicyModal type={activeModal} onClose={() => setActiveModal(null)} />}
    </main>
  )
}

export default AnalysisPage
