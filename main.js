const canvas = document.getElementById("gameCanvas");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const engine = new BABYLON.Engine(canvas, true);

let buildmode = true;
let scene;
let playCamera;
let buildCamera;

const createBaseScene = () => {
    const scene = new BABYLON.Scene(engine);
	BABYLON.Tags.EnableFor(scene);

	playCamera = new BABYLON.ArcRotateCamera("playCamera", Math.PI / 2, Math.PI / 2.5, 20, BABYLON.Vector3.Zero(), scene);
	playCamera.fov = 0.8;
	// playCamera.attachControl(canvas, true);

	buildCamera = new BABYLON.ArcRotateCamera("buildCamera", Math.PI / 2, Math.PI / 2.5, 20, BABYLON.Vector3.Zero(), scene);
	buildCamera.fov = 0.8;
	buildCamera.attachControl(canvas, true);

	scene.activeCamera = buildCamera;

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.85;

	const player = BABYLON.MeshBuilder.CreateBox("player", { height: .25, width: 1, depth: 1 }, scene);
	const playerMaterial = new BABYLON.StandardMaterial(
		"playerMaterial",
		scene
	);
	playerMaterial.diffuseColor = new BABYLON.Color3(1, 0, 1);
	player.material = playerMaterial;
	player.position.y = 0.25;

	const startPlatform = BABYLON.MeshBuilder.CreateBox("startPlatform", { height: .5, width: 5, depth: 5 }, scene);
	startPlatform.position.y = -0.25;
	BABYLON.Tags.AddTagsTo(startPlatform, "platform");

	const platformMaterial = new BABYLON.StandardMaterial("platformMaterial", scene);
	platformMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
	startPlatform.material = platformMaterial;

    return scene;
};

scene = createBaseScene();

function gameLoop() {

}

engine.runRenderLoop(() => {
	gameLoop();
	if (scene) {
		scene.render();
	}
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize();
});

window.addEventListener("click", (event) => {
	if (buildmode) {
		getClick(event);
	}
});

function switchMode() {
	buildmode = !buildmode;
	const button = document.getElementById("switchMode");
	if (buildmode) {
		button.textContent = "Building Mode";
		scene.activeCamera = buildCamera;
	} else {
		button.textContent = "Play Mode";
		scene.activeCamera = playCamera;
	}
}

function getClick(event) {
	const rect = canvas.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;

	const pickInfo = scene.pick(x, y);
	
	if (pickInfo.hit) {
		const pickedPoint = pickInfo.pickedPoint;
		const pickedMesh = pickInfo.pickedMesh;

		if (snapmode == true) {
			// get nearest snap indicator
			const snapIndicators = scene.getMeshesByTags("snapIndicator");
			let nearestIndicator;
			let nearestDistance = 10;
			for (const indicator of snapIndicators) {
				const distance = BABYLON.Vector3.Distance(indicator.position, pickedPoint);
				if (distance < nearestDistance) {
					nearestDistance = distance;
					nearestIndicator = indicator;
				}
			}
			if (nearestIndicator) {
				createClickIndicator(nearestIndicator.position);
				return;
			}
		}

		createClickIndicator(pickedPoint);
	} else {
		console.log("No mesh was hit");
	}
}

function createClickIndicator(position) {
	const existingIndicator = scene.getMeshByName("clickIndicator");
	if (existingIndicator) {
		existingIndicator.dispose();
	}

	const indicator = BABYLON.MeshBuilder.CreateSphere("clickIndicator", { diameter: 0.2 }, scene);
	const indicatorMaterial = new BABYLON.StandardMaterial("indicatorMaterial", scene);
	indicatorMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0);
	indicator.material = indicatorMaterial;
	indicator.position = position.clone();

	setTimeout(() => {
		if (indicator) {
			indicator.dispose();
		}
	}, 2000);
}
let snapmode = false;
function snapMode() {
	const button = document.getElementById("snapMode");
	if (button.textContent === "Snap Mode: On") {
		button.textContent = "Snap Mode: Off";
		const snapIndicators = scene.getMeshesByTags("snapIndicator");
		for (const indicator of snapIndicators) {
			indicator.dispose();
		}
		snapmode = false;
	} else {
		snapmode = true;
		button.textContent = "Snap Mode: On";
		const platforms = scene.getMeshesByTags("platform");
		// console.log(platforms);
		for (const platform of platforms) {
			const position = platform.position;

			const boundingInfo = platform.getBoundingInfo();
			const boundingBox = boundingInfo.boundingBox;

			const halfWidth = boundingBox.extendSize.x;
			const halfHeight = boundingBox.extendSize.y;
			const halfDepth = boundingBox.extendSize.z;

			const corners = [
				new BABYLON.Vector3(position.x - halfWidth, position.y + halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y + halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y + halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y + halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y - halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y - halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y - halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y - halfHeight, position.z - halfDepth),
			];

			const faceCenters = [
				new BABYLON.Vector3(position.x, position.y + halfHeight, position.z),
				new BABYLON.Vector3(position.x, position.y - halfHeight, position.z),
				new BABYLON.Vector3(position.x, position.y, position.z + halfDepth),
				new BABYLON.Vector3(position.x, position.y, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y, position.z),
				new BABYLON.Vector3(position.x + halfWidth, position.y, position.z),
			];
			
			const midEdges = [
				
				new BABYLON.Vector3(position.x, position.y + halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x, position.y + halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y + halfHeight, position.z),
				new BABYLON.Vector3(position.x + halfWidth, position.y + halfHeight, position.z),
				
				new BABYLON.Vector3(position.x, position.y - halfHeight, position.z + halfDepth),
				new BABYLON.Vector3(position.x, position.y - halfHeight, position.z - halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y - halfHeight, position.z),
				new BABYLON.Vector3(position.x + halfWidth, position.y - halfHeight, position.z),

				new BABYLON.Vector3(position.x - halfWidth, position.y, position.z + halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y, position.z + halfDepth),
				new BABYLON.Vector3(position.x - halfWidth, position.y, position.z - halfDepth),
				new BABYLON.Vector3(position.x + halfWidth, position.y, position.z - halfDepth),
			];

			const snapPoints = [...corners, ...faceCenters, ...midEdges];

			for (const point of snapPoints) {
				const snapIndicator = BABYLON.MeshBuilder.CreateBox("snapIndicator", { size: 0.1 }, scene);
				BABYLON.Tags.AddTagsTo(snapIndicator, "snapIndicator");
				const snapMaterial = new BABYLON.StandardMaterial("snapMaterial", scene);
				snapMaterial.diffuseColor = new BABYLON.Color3(0, 1, 1);
				snapIndicator.material = snapMaterial;
				snapIndicator.position = point.clone();
			}
		}
	}
}
