// Script de restauración de backup
// Uso: npm run restore -- <archivo_backup.json>

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function restaurarBackup(archivo) {
  console.log(` Restaurando desde ${archivo}...`)
  
  if (!fs.existsSync(archivo)) {
    console.error(`❌ Archivo no encontrado: ${archivo}`)
    process.exit(1)
  }

  const backupData = JSON.parse(fs.readFileSync(archivo, 'utf8'))
  const tablas = Object.keys(backupData)

  console.log(`📊 Tablas a restaurar: ${tablas.length}`)

  for (const tabla of tablas) {
    const datos = backupData[tabla]
    console.log(`📋 Restaurando ${tabla} (${datos.length} registros)...`)

    // Limpiar tabla primero
    const { error: deleteError } = await supabase
      .from(tabla)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      console.error(`⚠️ No se pudo limpiar ${tabla}:`, deleteError.message)
    }

    // Insertar datos en lotes de 100
    const lotes = []
    for (let i = 0; i < datos.length; i += 100) {
      lotes.push(datos.slice(i, i + 100))
    }

    for (const lote of lotes) {
      const { error } = await supabase
        .from(tabla)
        .insert(lote)

      if (error) {
        console.error(`❌ Error en ${tabla}:`, error.message)
        break
      }
    }

    console.log(`✅ ${tabla} restaurada`)
  }

  console.log('\n✅ Restauración completada')
}

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: npm run restore -- <archivo_backup.json>')
  console.error('Ejemplo: npm run restore -- backups/backup_2026-06-30.json')
  process.exit(1)
}

restaurarBackup(archivo).catch(error => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})