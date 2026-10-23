import { SupabaseClient } from '@supabase/supabase-js'

export interface AbonoProrrateado {
  zona_id: string
  zona_nombre: string
  periodo: string
  monto_original: number
  monto_prorrateado: number
}

const diasDeMes = (periodo: string) => {
  const [y, m] = periodo.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = []
  const [y1, m1] = desde.split('-').map(Number)
  const [y2, m2] = hasta.split('-').map(Number)
  let y = y1
  let m = m1
  while (y < y2 || (y === y2 && m <= m2)) {
    meses.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return meses
}

// Devuelve los abonos/facturas de zona que solapan el rango [desde, hasta],
// prorrateados por días. Para un mes completo entra el monto íntegro.
export async function calcularAbonos(
  supabase: SupabaseClient,
  desde: string, // YYYY-MM-DD
  hasta: string  // YYYY-MM-DD
): Promise<{ abonos: AbonoProrrateado[]; total: number }> {
  const meses = mesesEntre(desde, hasta)
  if (!meses.length) return { abonos: [], total: 0 }

  const { data, error } = await supabase
    .from('abonos_fijos')
    .select('zona_id, periodo, monto, zonas(nombre)')
    .in('periodo', meses)
  if (error || !data) return { abonos: [], total: 0 }

  const abonos: AbonoProrrateado[] = []
  data.forEach((row: any) => {
    const totalDias = diasDeMes(row.periodo)
    const primero = `${row.periodo}-01`
    const ultimo = `${row.periodo}-${String(totalDias).padStart(2, '0')}`
    const ini = primero > desde ? primero : desde
    const fin = ultimo < hasta ? ultimo : hasta
    if (ini > fin) return
    const diasSolapados = Math.round((new Date(fin).getTime() - new Date(ini).getTime()) / 86400000) + 1
    const monto = Number(row.monto) || 0
    abonos.push({
      zona_id: row.zona_id,
      zona_nombre: row.zonas?.nombre || 'Sin zona',
      periodo: row.periodo,
      monto_original: monto,
      monto_prorrateado: monto * (diasSolapados / totalDias)
    })
  })

  return { abonos, total: abonos.reduce((a, b) => a + b.monto_prorrateado, 0) }
}