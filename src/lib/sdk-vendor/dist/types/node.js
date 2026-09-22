// ---------------------------------------------------------------------------
// Node types
//
// Derived from the Neon Storage Controller source:
//   storage_controller/src/http.rs     – handle_node_register, handle_node_configure,
//                                        handle_node_list, handle_node_status,
//                                        handle_node_delete, handle_cancel_node_delete
//   libs/pageserver_api/src/controller_api.rs – NodeRegisterRequest,
//                                               NodeConfigureRequest,
//                                               NodeAvailabilityWrapper,
//                                               NodeSchedulingPolicy
//
// Endpoints modelled here:
//   POST   /control/v1/node                         → register       (void)
//   PUT    /control/v1/node/:node_id/config         → configure      (void)
//   PUT    /control/v1/node/:node_id/delete         → startDelete    (void, async)
//   DELETE /control/v1/node/:node_id/delete         → cancelDelete   (void)
//   GET    /control/v1/node                         → NodeDescribeResponse[]
//   GET    /control/v1/node/:node_id                → NodeDescribeResponse
//
// All node endpoints live on the /control/v1/ administrative surface.
// The Virtual Pageserver surface (/v1/) has no node endpoints.
// ---------------------------------------------------------------------------
export {};
//# sourceMappingURL=node.js.map