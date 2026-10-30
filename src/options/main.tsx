import { render } from 'preact';
import '../styles.css';
import { App } from '../lib/ui/App';

render(<App mode="options" />, document.getElementById('app')!);
