import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

const Landing = () => {
  return (
    <main className="flex flex-col gap-4 items-center justify-center min-h-screen p-6">
      <p>Landing under construction</p>
      <Link href="/app" className={buttonVariants()}>
        Continue to the app
      </Link>
    </main>
  )
}

export default Landing
