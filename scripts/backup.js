// Script de backup de base de datos
// Uso: npm run backup

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Configuración
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('📁 Verificá que el archivo .env.local exista en la raíz del proyecto')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Tablas a backupear
const TABLAS = [
  'empleados',
  'recibos_sueldo',
  'solicitudes_sueldo',
  'incentivos',
  'descuentos_incentivos',
  'notificaciones',
  'solicitudes_cambio_cbu',
  'solicitudes_vacaciones',
  'backup_logs'
]

async function hacerBackup() {
  console.log('🔄 Iniciando backup...')
  const fecha = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(__dirname, '..', 'backups')
  
  // Crear directorio de backups si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir)
  }

  const backupData = {}
  let totalRegistros = 0
  let tablasOk = 0

  // Exportar cada tabla
  for (const tabla of TABLAS) {
    console.log(`📋 Exportando ${tabla}...`)
    
    try {
      const { data, error } = await supabase
        .from(tabla)
        .select('*')

      if (error) {
        console.error(`❌ Error en ${tabla}:`, error.message)
        continue
      }

      backupData[tabla] = data
      totalRegistros += data.length
      tablasOk++
      console.log(`✅ ${tabla}: ${data.length} registros`)
    } catch (error) {
      console.error(`❌ Error en ${tabla}:`, error.message)
    }
  }

  // Guardar backup local
  const backupFile = path.join(backupDir, `backup_${fecha}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2))
  const tamañoBytes = fs.statSync(backupFile).size

  console.log(`\n✅ Backup completado:`)
  console.log(` Archivo: ${backupFile}`)
  console.log(`📊 Tablas: ${tablasOk}/${TABLAS.length}`)
  console.log(` Registros: ${totalRegistros}`)
  console.log(`💾 Tamaño: ${(tamañoBytes / 1024).toFixed(2)} KB`)

  // Registrar en backup_logs
  const { error: logError } = await supabase
    .from('backup_logs')
    .insert({
      tablas_backupeadas: tablasOk,
      tamaño_bytes: tamañoBytes,
      estado: 'completado',
      archivo_url: backupFile
    })

  if (logError) {
    console.error('⚠️ No se pudo registrar el backup:', logError.message)
  }

  // Eliminar backups antiguos (mantener últimos 7)
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_'))
    .sort()
    .reverse()

  if (backups.length > 7) {
    const aEliminar = backups.slice(7)
    aEliminar.forEach(archivo => {
      fs.unlinkSync(path.join(backupDir, archivo))
      console.log(`🗑️ Eliminado: ${archivo}`)
    })
  }

  console.log('\n✅ Proceso completado')
}

hacerBackup().catch(error => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})