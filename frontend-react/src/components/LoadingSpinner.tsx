import './LoadingSpinner.css';

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner-wrap">
      <span className="loading-spinner" aria-label="Loading…" />
    </div>
  );
}
