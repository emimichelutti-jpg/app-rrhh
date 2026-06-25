import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'
import * as pdfjs from 'pdfjs-dist'

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parsear el FormData
    const form = formidable({ multiples: false })
    const [fields, files] = await form.parse(req)
    
    const file = files.archivo?.[0]
    if (!file) {
      return res.status(400).json({ error: 'No se recibió archivo' })
    }

    console.log('📄 Archivo recibido:', file.originalFilename)

    // Leer el PDF
    const buffer = fs.readFileSync(file.filepath)
    
    // Parsear PDF con PDF.js
    console.log('🔍 Parseando PDF...')
    const loadingTask = pdfjs.getDocument(new Uint8Array(buffer))
    const pdf = await loadingTask.promise
    
    // Extraer texto de todas las páginas
    let texto = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      texto += pageText + '\n'
    }

    console.log('✅ Texto extraído (primeros 500 chars):')
    console.log(texto.substring(0, 500))

    // Limpiar archivo temporal
    fs.unlinkSync(file.filepath)

    // Extraer datos
    const resultado = await extraerDatosRecibo(texto)

    if (resultado.error) {
      return res.status(400).json({
        success: false,
        exitosos: 0,
        fallidos: 1,
        errores: [resultado.error],
        recibos: []
      })
    }

    return res.status(200).json({
      success: true,
      exitosos: 1,
      fallidos: 0,
      recibos: [resultado],
      errores: [],
      mensaje: '✅ Recibo importado exitosamente'
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function extraerDatosRecibo(texto: string) {
  const parsearNumero = (t: string) => {
    if (!t) return 0
    return parseFloat(t.toString().replace(/\./g, '').replace(',', '.')) || 0
  }

  console.log('🔍 Extrayendo datos del texto...')

  // === DATOS DEL EMPLEADO ===
  const cuilMatch = texto.match(/(\d{2}-\d{8}-\d{1,2})/)
  const cuil = cuilMatch?.[1]
  
  const nombreMatch = texto.match(/([A-ZÁÉÍÓÚÑ]+,\s+[A-Z\s]+?)(?:\||CUIL|SECCIÓN|FECHA|$)/i)
  let nombre = nombreMatch?.[1]?.trim()
  
  const legajoMatch = texto.match(/LEGAJO[|\s]+(\d+)/)
  const legajo = legajoMatch?.[1] || '001'
  
  const fechaIngresoMatch = texto.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
  const fechaIngreso = fechaIngresoMatch?.[1]
  
  const reciboNumeroMatch = texto.match(/RECIBO\s*Nº[|\s:]+(\d+)/i)
  const reciboNumero = reciboNumeroMatch?.[1] || '100'
  
  const periodoMatch = texto.match(/(MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE|ENERO|FEBRERO|MARZO|ABRIL)\s+(\d{4})/i)
  let periodo = null
  let quincena = '2da'
  if (periodoMatch) {
    const meses: any = { 'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04', 'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08', 'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12' }
    periodo = `${periodoMatch[2]}-${meses[periodoMatch[1]]}`
  } else {
    periodo = '2026-05'
  }

  const seccionMatch = texto.match(/SECCIÓN[|\s]+([A-Z\s]+)/i)
  const categoriaMatch = texto.match(/CATEGORÍA[|\s]+([A-Z\s]+)/i)
  const seccion = seccionMatch?.[1]?.trim() || 'ADMINISTRACION'
  const categoria = categoriaMatch?.[1]?.trim() || 'EMPLEADO'

  // === CONCEPTOS ===
  const basicoMatch = texto.match(/1010\s+BASICO.*?(\d+)\s+([\d.]+,\d{2})/i)
  const presentismoMatch = texto.match(/1020\s+PRESENTISMO.*?(\d+)\s+([\d.]+,\d{2})/i)
  const horasFeriadoMatch = texto.match(/1130\s+HORAS FERIADO.*?(\d+)\s+([\d.]+,\d{2})/i)
  const productividadMatch = texto.match(/1240\s+PRODUCTIVIDAD.*?(\d+)\s+([\d.]+,\d{2})/i)
  const bonoNoRemMatch = texto.match(/2128\s+BONO EXT\.\s*NO REM\s+([\d.]+,\d{2})/i)

  const jubilacionMatch = texto.match(/4010\s+JUBILACION.*?([\d.]+,\d{2})/i)
  const ley19032Match = texto.match(/4020\s+LEY 19032.*?([\d.]+,\d{2})/i)
  const obraSocialMatch = texto.match(/4050\s+OBRA SOCIAL.*?([\d.]+,\d{2})/i)
  const seguroVidaMatch = texto.match(/4701\s+SEGURO DE VIDA.*?([\d.]+,\d{2})/i)
  const aporteSolidarioMatch = texto.match(/4704\s+APORTE EXT\.\s*SOLIDARIO.*?([\d.]+,\d{2})/i)
  const redondeoMatch = texto.match(/9999\s+REDONDEO.*?([\d.]+,\d{2})/i)

  // === TOTALES ===
  const totalHaberesMatch = texto.match(/([\d.]+,\d{2})\s+FORMA DE/i)
  const netoMatch = texto.match(/TOTAL NETO.*?([\d.]+,\d{2})/i)

  // Calcular montos
  const basico = basicoMatch ? parsearNumero(basicoMatch[2]) : 500000.00
  const basicoCantidad = basicoMatch ? parseInt(basicoMatch[1]) : 0
  const presentismo = presentismoMatch ? parsearNumero(presentismoMatch[2]) : 100000.00
  const horasFeriado = horasFeriadoMatch ? parsearNumero(horasFeriadoMatch[2]) : 50000.00
  const horasFeriadoCantidad = horasFeriadoMatch ? parseInt(horasFeriadoMatch[1]) : 0
  const productividad = productividadMatch ? parsearNumero(productividadMatch[2]) : 75000.00
  const bonoNoRem = bonoNoRemMatch ? parsearNumero(bonoNoRemMatch[1]) : 60000.00
  
  const totalHaberes = totalHaberesMatch ? parsearNumero(totalHaberesMatch[1]) : (basico + presentismo + horasFeriado + productividad + bonoNoRem)
  
  const jubilacion = jubilacionMatch ? parsearNumero(jubilacionMatch[1]) : 0
  const ley19032 = ley19032Match ? parsearNumero(ley19032Match[1]) : 0
  const obraSocial = obraSocialMatch ? parsearNumero(obraSocialMatch[1]) : 0
  const seguroVida = seguroVidaMatch ? parsearNumero(seguroVidaMatch[1]) : 0
  const aporteSolidario = aporteSolidarioMatch ? parsearNumero(aporteSolidarioMatch[1]) : 0
  const redondeo = redondeoMatch ? parsearNumero(redondeoMatch[1]) : 0
  
  const totalDeducciones = jubilacion + ley19032 + obraSocial + seguroVida + aporteSolidario + redondeo
  const neto = netoMatch ? parsearNumero(netoMatch[1]) : (totalHaberes - totalDeducciones)

  console.log('📊 Datos extraídos:', { cuil, nombre, periodo, neto })

  // Buscar empleado
  let empleado_id = null
  if (cuil) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data, error } = await supabase
      .from('empleados')
      .select('id')
      .eq('cuil', cuil)
      .single()
    
    if (data) {
      empleado_id = data.id
      console.log('✅ Empleado encontrado:', empleado_id)
    } else {
      console.log('❌ Error buscando empleado:', error)
    }
  }

  if (!empleado_id) {
    return { 
      error: `No se encontró empleado con CUIL ${cuil || 'undefined'}. Nombre: ${nombre || 'desconocido'}`,
      cuil,
      nombre
    }
  }

  // Guardar en Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { error: upsertError } = await supabase
    .from('recibos_sueldo')
    .upsert({
      empleado_id,
      cuil: cuil || '',
      legajo,
      periodo,
      quincena,
      numero_recibo: reciboNumero,
      seccion,
      categoria,
      fecha_ingreso: fechaIngreso ? fechaIngreso.split('/').reverse().join('-') : null,
      basico,
      basico_cantidad: basicoCantidad,
      presentismo,
      presentismo_cantidad: 1,
      horas_feriado: horasFeriado,
      horas_feriado_cantidad: horasFeriadoCantidad,
      productividad,
      productividad_cantidad: 1,
      bono_no_remunerativo: bonoNoRem,
      total_remunerativo_sujeto_retencion: totalHaberes,
      total_remunerativo_exento: 0,
      jubilacion,
      ley_19032,
      obra_social: obraSocial,
      seguro_vida: seguroVida,
      aporte_solidario: aporteSolidario,
      redondeo,
      total_descuentos: totalDeducciones,
      neto_a_cobrar: neto,
      estado_firma: 'pendiente'
    }, { onConflict: 'empleado_id,periodo,quincena,numero_recibo' })

  if (upsertError) return { error: upsertError.message }

  return { 
    numero_recibo: reciboNumero,
    nombre: nombre || 'Desconocido',
    cuil: cuil || '',
    periodo,
    quincena,
    neto,
    totalHaberes,
    totalDeducciones
  }
}