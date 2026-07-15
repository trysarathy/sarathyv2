import AuthPhonePreview from './AuthPhonePreview'

const VALUE_PROPS = [
  {
    icon: '🧠',
    title: 'Understands your context',
    body: "Knows you're a student in Singapore managing SGD, INR, and everything in between",
  },
  {
    icon: '📅',
    title: 'Shows up daily',
    body: 'A personalised brief every morning before you even ask',
  },
  {
    icon: '💚',
    title: 'Deeply personal',
    body: 'Not a spreadsheet. A companion that gets how emotional money really is.',
  },
] as const

export default function AuthStoryPanel() {
  return (
    <aside className="auth-story">
      <div className="auth-story-inner">
        <div>
          <h1 className="auth-story-title">Welcome back to Sarathy ✦</h1>
          <p className="auth-story-sub">
            The AI financial companion built for international students managing money alone in a new country.
          </p>
        </div>

        <ul className="auth-story-props">
          {VALUE_PROPS.map((prop) => (
            <li key={prop.title} className="auth-story-prop">
              <span className="auth-story-prop-icon" aria-hidden="true">
                {prop.icon}
              </span>
              <div>
                <p className="auth-story-prop-title">{prop.title}</p>
                <p className="auth-story-prop-body">{prop.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="auth-story-preview">
          <AuthPhonePreview />
          <blockquote className="auth-story-quote">
            <p>
              &ldquo;Finally something that gets what it feels like to budget in SGD while thinking in
              rupees.&rdquo;
            </p>
            <footer>— Sarathy Beta User, SMU</footer>
          </blockquote>
        </div>
      </div>
    </aside>
  )
}
