import { Logger } from '../logger';

export const NotFound = () => {
    Logger.error('404 Not Found');
    return <div>Nova Error: 404 Not Found</div>;
};
