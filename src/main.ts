import { App } from '@app/App';
import { installFatalHandlers, showFatal } from '@ui/fatal';

// Any error — startup, scene crash, or unhandled rejection — becomes a visible,
// recoverable message instead of a silent blank screen.
installFatalHandlers();

const app = new App();
app.start().catch((err) => {
  showFatal('Failed to start', err?.stack ?? err?.message ?? String(err));
});
