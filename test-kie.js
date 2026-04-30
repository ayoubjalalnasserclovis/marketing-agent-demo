async function check() {
    const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=629dc31e059c3c0de64f6698cd3d9021`, {
        headers: { 'Authorization': 'Bearer d7ef09b63547679856637d4256d0f7da' }
    });
    const pollData = await pollRes.json();
    console.log(JSON.stringify(pollData, null, 2));
}
check();
