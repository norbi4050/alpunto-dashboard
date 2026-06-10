import { ReservarFlow } from './ReservarFlow'

export const metadata = { title: 'Reservar turno — AlPunto Barbería' }

export default function ReservarPage({
  searchParams,
}: {
  searchParams: { t?: string }
}) {
  return <ReservarFlow token={searchParams.t} />
}
