import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken } from "./auth";

// Inject token into customFetch using the exposed configuration hook
setAuthTokenGetter(() => getToken());
