import page from './page.module.css'
import shell from './shell/shell.module.css'

/** Shared page chrome (shell) + remaining page tokens. Feature CSS merges on top. */
const pageStyles = { ...shell, ...page }

export default pageStyles
