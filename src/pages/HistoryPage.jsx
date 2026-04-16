import AppHeader from '../components/AppHeader'

function HistoryPage({
  headerProps,
  historyItems,
  handleLoadHistory,
  handleDeleteHistory,
  activeModal,
  setActiveModal,
  components,
}) {
  const { PageFooter, PolicyModal } = components

  const confirmDelete = (id) => {
    const shouldDelete = window.confirm('Delete this history entry? This action cannot be undone.')
    if (shouldDelete) {
      handleDeleteHistory(id)
    }
  }

  return (
    <main className="screen results-screen">
      <AppHeader {...headerProps} />
      <section className="history-wrap">
        <p className="eyebrow">Saved Local History</p>
        <h2 className="serif">Previous Analyses</h2>
        {historyItems.length === 0 ? (
          <p className="status">No history yet. Run an analysis and it will appear here.</p>
        ) : (
          <div className="history-list">
            {historyItems.map((item) => (
              <article key={item.id} className="history-item">
                <div>
                  <p className="history-title">{item.verdict} - {item.score}%</p>
                  <p className="history-meta">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <div className="history-actions">
                  <button type="button" onClick={() => handleLoadHistory(item)}>Load Analysis</button>
                  <button type="button" className="history-delete" onClick={() => confirmDelete(item.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <PageFooter onModalOpen={setActiveModal} />
      {activeModal && <PolicyModal type={activeModal} onClose={() => setActiveModal(null)} />}
    </main>
  )
}

export default HistoryPage
