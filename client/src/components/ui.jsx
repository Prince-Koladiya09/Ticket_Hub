export function ErrorBox({ error }) {
  if (!error) return null;
  const details = Array.isArray(error.details) ? error.details.map((d) => d.message).join(' - ') : null;
  return (
    <div className="error-box">
      {error.message || 'Something went wrong'}
      {details ? <div style={{ fontSize: '0.85em', marginTop: 4 }}>{details}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return <div className="empty">{label}</div>;
}
