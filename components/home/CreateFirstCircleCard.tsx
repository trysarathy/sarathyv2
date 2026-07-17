'use client'

interface Props {
  onCreate: () => void
}

export default function CreateFirstCircleCard({ onCreate }: Props) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8DFC8',
        borderRadius: 12,
        padding: '16px 14px',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 15,
          fontWeight: 700,
          color: '#1C0F3F',
          lineHeight: 1.35,
        }}
      >
        Split costs with friends — zero awkwardness 👥
      </p>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          color: '#7A6E5A',
          lineHeight: 1.45,
        }}
      >
        Create a circle for your flatmates, travel group, or family
      </p>
      <button
        type="button"
        onClick={onCreate}
        style={{
          width: '100%',
          background: '#1C0F3F',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 10,
          padding: '11px 14px',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Create circle →
      </button>
    </div>
  )
}
