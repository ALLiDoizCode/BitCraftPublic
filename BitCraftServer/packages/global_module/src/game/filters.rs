use spacetimedb::{client_visibility_filter, Filter};

#[client_visibility_filter]
const DM_SENDER_FILTER: Filter = Filter::Sql(
    "
    SELECT d.*
    FROM direct_message_state d
    JOIN user_state u ON d.sender_entity_id = u.entity_id
    WHERE u.identity = :sender
",
);

#[client_visibility_filter]
const DM_RECEIVER_FILTER: Filter = Filter::Sql(
    "
    SELECT d.*
    FROM direct_message_state d
    JOIN user_state u ON d.receiver_entity_id = u.entity_id
    WHERE u.identity = :sender
",
);

// #[client_visibility_filter]
// const CHAT_MESSAGE_SENDER_FILTER: Filter = Filter::Sql(
//     "
//     SELECT CMS.*
//     FROM chat_message_state CMS
//     JOIN user_state US ON CMS.owner_entity_id = US.entity_id
//     WHERE US.identity = :sender
// ",
// );

// #[client_visibility_filter]
// const CHAT_MESSAGE_RECEIVER_FILTER: Filter = Filter::Sql(
//     "
//     SELECT CMS.*
//     FROM chat_message_state CMS
//     JOIN user_state US ON CMS.target_id = US.entity_id
//     WHERE US.identity = :sender
// ",
// );

#[client_visibility_filter]
const CHAT_CHANNEL_FILTER: Filter = Filter::Sql(
    "
    SELECT CMS.*
    FROM chat_message_state CMS
    JOIN chat_channel_permission_state CCPS ON CMS.target_id = CCPS.chat_channel_entity_id
    WHERE CCPS.identity = :sender AND CCPS.rank >= 2 AND CCPS.rank != 4
",
);
