export default function WerewolfLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md h-dvh overflow-y-auto p-4">
      {children}
    </div>
  )
}
