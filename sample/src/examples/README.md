# SDK Examples

This directory contains example code demonstrating how to use the Wire Apps TypeScript SDK in different scenarios.

The examples are divided into two categories:

```
examples/
  callbacks/
  standalone/
```

All examples share two small helpers:

- [`ExampleConfig.ts`](./ExampleConfig.ts) – reads `WIRE_SDK_API_TOKEN` / `WIRE_SDK_API_HOST` from the `.env` file
  in the repository root and provides the cryptography storage key.
- [`ExampleLogger.ts`](./ExampleLogger.ts) – a single `PinoLogger` instance shared by the SDK and the examples.

---

## callbacks/

Examples in this [directory](./callbacks) demonstrate how to **handle SDK events via callbacks**.

Each class extends `WireEventsHandler` and overrides the callback methods relevant to the specific example.

### Running a callback example

Run the callback runner with the name of the example class:

```bash
npm run -w sample example:callback -- ReplyMessageExample
```

The runner ([`RunCallbackExample.ts`](./RunCallbackExample.ts)) starts the SDK with the events handler of the given
example, so your example class will receive and handle the relevant events. Running it without a name prints the list
of the available examples.

Alternatively, you can use an example directly in your own app entry point:

```ts
const sdk = await WireAppSdk.create(apiToken, apiHost, cryptographyStorageKey, new ReplyMessageExample(), logger)
sdk.setBackendConnectionListener(backendConnectionListener)
await sdk.startListening()
```

### Available callback examples

| Example                                          | What it does                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `GreetConversationOnAppAddedExample`             | Sends a greeting when the app is added to a conversation                            |
| `GreetNewJoinerInConversationExample`            | Welcomes every user who joins a conversation, addressing them by name               |
| `CreateOneToOneConversationWithNewJoinerExample` | Creates a 1-1 conversation with a new joiner and greets them there                  |
| `ReplyMessageExample`                            | Replies to every received text message                                              |
| `ReadAndReactOnTextMsgReceivedExample`           | Sends a read receipt and adds emoji reactions to received text messages             |
| `SendPingExample`                                | Sends a ping when a message contains "ping me"                                      |
| `SendEphemeralMessageExample`                    | Sends a self-deleting message when a message contains "send me the password"        |
| `SendWireLocationInfoExample`                    | Sends a location message when a message contains "where is wire?"                   |
| `DownloadOnAssetReceivedExample`                 | Downloads received assets to the local file system and confirms in the conversation |

---

## standalone/

Examples in this [directory](./standalone) are **self-contained runnable programs**.

Each example creates its own SDK instance, performs a single operation and shuts the SDK down again. They use
[`NoOpWireEventsHandler`](./standalone/NoOpWireEventsHandler.ts), since they don't need to react to incoming events.

### Running a standalone example

1. Ensure the required **environment variables** are set correctly in the `.env` file of the repository root.
2. Run the example with its npm script:

```bash
npm run -w sample example:create-group-conversation
npm run -w sample example:broadcast-to-all-conversations
```

Both scripts build the sample first and then run the compiled example from `sample/build/examples/standalone/`.

### Available standalone examples

| Example                                | What it does                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `CreateGroupConversationExample`       | Collects all users from the app's conversations and creates a group conversation with them |
| `SendMessageToAllConversationsExample` | Broadcasts an announcement to all stored conversations every 5 seconds, 2 times            |

---

## Purpose of the examples

The examples are intended to help developers:

- understand how to integrate the SDK into their applications
- learn how to react to SDK events
- quickly test SDK functionality
- explore common usage patterns
