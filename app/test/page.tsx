export default function Test() {
    return (
        <pre>
            {JSON.stringify({
                REGION: process.env.REGION,
                TCLOUD_ENV_ID: process.env.TCLOUD_ENV_ID,
                HAS_ID: !!process.env.TCLOUD_SECRET_ID,
                HAS_KEY: !!process.env.TCLOUD_SECRET_KEY,
            }, null, 2)}
        </pre>
    )
}