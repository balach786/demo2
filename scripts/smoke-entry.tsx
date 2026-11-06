import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from '../src/App';
import { RangeProvider, StoreProvider } from '../src/demo/store';

export function renderRoute(path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <StoreProvider>
        <RangeProvider>
          <App />
        </RangeProvider>
      </StoreProvider>
    </StaticRouter>,
  );
}
