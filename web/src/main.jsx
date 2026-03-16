import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// 💡 ELIMINADO: import './index.css'
// 💡 ELIMINADO: import './styles.css'
// (App.jsx ya importa App.css, que será nuestro único archivo global)

createRoot(document.getElementById('root')).render(
  <App />,
) 
