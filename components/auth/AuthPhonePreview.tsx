/** CSS phone frame with a stylised Sarathy home preview */
export default function AuthPhonePreview() {
  return (
    <div className="auth-phone" aria-hidden="true">
      <div className="auth-phone-notch" />
      <div className="auth-phone-screen">
        <div className="auth-phone-hero">
          <p className="auth-phone-label">Safe to spend today</p>
          <p className="auth-phone-amount">S$47</p>
          <p className="auth-phone-sub">Based on today&apos;s expenses only</p>
        </div>
        <div className="auth-phone-body">
          <div className="auth-phone-cta">+ Log expense</div>
          <div className="auth-phone-row">
            <span className="auth-phone-chip">Ask Sarathy</span>
            <span className="auth-phone-mic">🎤</span>
          </div>
          <div className="auth-phone-card">
            <p className="auth-phone-card-title">This month</p>
            <div className="auth-phone-bar">
              <div className="auth-phone-bar-fill" />
            </div>
            <p className="auth-phone-card-meta">S$312 of S$800 spent</p>
          </div>
        </div>
      </div>
    </div>
  )
}
