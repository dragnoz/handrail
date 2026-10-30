import { render } from 'preact';
import '../styles.css';
import { App } from '../lib/ui/App';

render(<App mode="panel" />, document.getElementById('app')!);
