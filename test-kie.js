async function check() {
    const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=629dc31e059c3c0de64f6698cd3d9021`, {
        headers: { 'Authorization': 'Bearer b47967b4f41b450df9cf9bd41aac166e' }
    });
    const pollData = await pollRes.json();
    console.log(JSON.stringify(pollData, null, 2));
}
check();
