// Cargar variables de entorno desde .env.local
require('dotenv').config({ path: '.env.local' })

const bcrypt = require('bcryptjs')
const { createClient } = require('@supabase/supabase-js')

// Verificar que las variables estén cargadas
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Variables de entorno no encontradas')
  console.error('Verificá que el archivo .env.local exista y tenga:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function setPassword() {
  const cuil = '20-28729145-1'
  const password = '123456'
  
  console.log('🔄 Buscando empleado con CUIL:', cuil)
  
  // Buscar empleado
  const { data: empleado, error } = await supabase
    .from('empleados')
    .select('id, nombre_completo, email')
    .eq('cuil', cuil)
    .single()
  
  if (error || !empleado) {
    console.error('❌ Error:', error?.message || 'Empleado no encontrado')
    return
  }
  
  console.log('✅ Empleado encontrado:', empleado.nombre_completo)
  console.log('📧 Email:', empleado.email)
  
  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(password, 10)
  console.log('🔐 Contraseña hasheada:', hashedPassword.substring(0, 20) + '...')
  
  // Actualizar en la base de datos
  const { error: updateError } = await supabase
    .from('empleados')
    .update({ password_hash: hashedPassword })
    .eq('id', empleado.id)
  
  if (updateError) {
    console.error('❌ Error actualizando:', updateError.message)
    return
  }
  
  console.log('✅ Contraseña actualizada exitosamente')
  console.log('📝 Datos de prueba:')
  console.log('   CUIL:', cuil)
  console.log('   Contraseña:', password)
}

setPassword()