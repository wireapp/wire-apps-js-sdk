# Wire™

[![Wire logo](https://github.com/wireapp/wire/blob/master/assets/header-small.png?raw=true)](https://wire.com/jobs/)

This repository is part of the source code of Wire. You can find more information at [wire.com](https://wire.com) or by contacting opensource@wire.com.

You can find the published source code at [github.com/wireapp/wire](https://github.com/wireapp/wire), and the apk of the latest release at [https://wire.com/en/download/](https://wire.com/en/download/).

For licensing information, see the attached LICENSE file and the list of third-party licenses at [wire.com/legal/licenses/](https://wire.com/legal/licenses/).

If you compile the open source software that we make available from time to time to develop your own mobile, desktop or web application, and cause that application to connect to our servers for any purposes, we refer to that resulting application as an “Open Source App”. All Open Source Apps are subject to, and may only be used and/or commercialized in accordance with, the Terms of Use applicable to the Wire Application, which can be found at https://wire.com/legal/#terms. Additionally, if you choose to build an Open Source App, certain restrictions apply, as follows:

a. You agree not to change the way the Open Source App connects and interacts with our servers;

b. You agree not to weaken any of the security features of the Open Source App;

c. You agree not to use our servers to store data for purposes other than the intended and original functionality of the Open Source App;

d. You acknowledge that you are solely responsible for any and all updates to your Open Source App.

For clarity, if you compile the open source software that we make available from time to time to develop your own mobile, desktop or web application, and do not cause that application to connect to our servers for any purposes, then that application will not be deemed an Open Source App and the foregoing will not apply to that application.

No license is granted to the Wire trademark and its associated logos, all of which will continue to be owned exclusively by Wire Swiss GmbH. Any use of the Wire trademark and/or its associated logos is expressly prohibited without the express prior written consent of Wire Swiss GmbH.

# Wire Applications JS SDK

SDK for Wire third-party applications written in Typescript, supporting Typescript and Javascript languages.
Import the SDK in your project to build your application and interact with the Wire backend and serve your users.

This will create a full-fledged client. It can send or receive
messages, place or receive calls, for example.

After completing the onboarding process, the Wire platform will provide an APP_TOKEN,
required to authenticate your application via the SDK.

Deploying the application and initializing the SDK will enable it to receive invites to Team and then reading/writing
messages to it.

## How to use it

Install the SDK in a Node application:

```shell
npm install @wireapp/wire-apps-js-sdk
```

Create an app-specific `WireEventsHandler`, then initialize the SDK with the Wire application credentials and cryptography storage key provided by your app configuration.

## Requirements

- Node v22
- Access to the file system to store cryptographic keys and data

## Runtime storage

The SDK manages its own local storage under `./storage`, relative to the host process working directory.

It creates and uses:

```text
storage/
├── apps.db
└── cryptography
    ├── <App_ID>
    ├── <App_ID>-shm
    └── <App_ID>-wal
```

The SQLite schema is initialized by SDK startup through migrations shipped with the package. If you bundle the SDK with tools such as webpack, esbuild, or Rollup, make sure `build/db/migrations/**` is copied and preserved next to `build/db/DatabaseService.js`. Bundlers often do not include `.sql` files automatically.

## Import with

The SDK is published as an ESM package. Import it with standard `import` syntax:

```ts
import {
  WireAppSdk,
  WireEventsHandler,
  TextMessage
} from '@wireapp/wire-apps-js-sdk'
```

CommonJS `require()` is not the supported integration path for this alpha release.

## Environment Variables

Environment Variables can be checked from: `.env.example` file

```
WIRE_SDK_USER_ID=your-user-ID-UUID-format
WIRE_SDK_API_TOKEN=your-api-token
WIRE_SDK_USER_DOMAIN=yourdomain
WIRE_SDK_API_HOST=https://your-api.host
```

## Running the sample App

For a clean local run, install dependencies after cleaning the repository:

```shell
npm run clean:all
npm install
```

Then build the SDK and start the sample app:

```shell
npm run build
npm run sample
```

The `sample` script builds the sample workspace and starts it. It expects the environment variables listed above to be available from the repository `.env` file.

## Troubleshooting

If the SDK fails to start because a native module cannot be loaded, check that Node was installed for the same CPU architecture as the native dependencies. On Apple Silicon, mixing an x64 Node binary with arm64 native libraries, or the reverse, can cause `dlopen` architecture errors. Reinstalling dependencies with the intended Node binary usually fixes this.

If database migrations fail at startup, verify that the package was built before running and that `build/db/migrations/**` exists. Published npm installs include these files, but local development builds need `npm run build` to copy them into `build`.

If environment variables are missing, confirm that `.env` exists at the repository root when running the bundled sample app. The sample validates `WIRE_SDK_USER_ID`, `WIRE_SDK_API_TOKEN`, `WIRE_SDK_USER_DOMAIN`, and `WIRE_SDK_API_HOST` on startup.

### Testing the SDK

Run the SDK typecheck and test suite with:

```shell
npm run test:typecheck
```

To build the SDK and run the sample app:

```shell
npm run build
npm run sample
```

Before publishing, verify the package artifact with:

```shell
npm pack --dry-run
```
